"""Cloudflare R2 storage service using S3-compatible API."""

import uuid

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _get_s3_client():  # type: ignore[no-untyped-def]
    """Create an S3 client configured for Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=BotoConfig(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
        region_name="auto",
    )


def generate_object_key(user_id: uuid.UUID, audio_file_id: uuid.UUID) -> str:
    """Generate a safe object key. Never uses user-supplied filenames."""
    return f"users/{user_id}/audio/{audio_file_id}/source"


class R2StorageService:
    """Manages interactions with Cloudflare R2 object storage."""

    def __init__(self) -> None:
        self._client = _get_s3_client()
        self._bucket = settings.r2_bucket_name

    def create_multipart_upload(self, object_key: str, content_type: str) -> str:
        """Initiate a multipart upload. Returns the upload_id."""
        try:
            response = self._client.create_multipart_upload(
                Bucket=self._bucket,
                Key=object_key,
                ContentType=content_type,
            )
            upload_id = response["UploadId"]
            logger.info(
                "multipart_upload_created",
                object_key=object_key,
                upload_id=upload_id,
            )
            return upload_id
        except ClientError as e:
            logger.error("multipart_upload_create_failed", object_key=object_key, error=str(e))
            raise

    def generate_presigned_part_url(
        self, object_key: str, upload_id: str, part_number: int
    ) -> str:
        """Generate a presigned URL for uploading a single part."""
        try:
            url = self._client.generate_presigned_url(
                "upload_part",
                Params={
                    "Bucket": self._bucket,
                    "Key": object_key,
                    "UploadId": upload_id,
                    "PartNumber": part_number,
                },
                ExpiresIn=settings.upload_url_expiry,
            )
            return url
        except ClientError as e:
            logger.error(
                "presigned_part_url_failed",
                object_key=object_key,
                part_number=part_number,
                error=str(e),
            )
            raise

    def complete_multipart_upload(
        self,
        object_key: str,
        upload_id: str,
        parts: list[dict[str, int | str]],
    ) -> None:
        """Complete a multipart upload with the given parts."""
        try:
            self._client.complete_multipart_upload(
                Bucket=self._bucket,
                Key=object_key,
                UploadId=upload_id,
                MultipartUpload={"Parts": parts},
            )
            logger.info(
                "multipart_upload_completed",
                object_key=object_key,
                upload_id=upload_id,
                part_count=len(parts),
            )
        except ClientError as e:
            logger.error(
                "multipart_upload_complete_failed",
                object_key=object_key,
                upload_id=upload_id,
                error=str(e),
            )
            raise

    def abort_multipart_upload(self, object_key: str, upload_id: str) -> None:
        """Abort a multipart upload."""
        try:
            self._client.abort_multipart_upload(
                Bucket=self._bucket,
                Key=object_key,
                UploadId=upload_id,
            )
            logger.info("multipart_upload_aborted", object_key=object_key, upload_id=upload_id)
        except ClientError as e:
            logger.error(
                "multipart_upload_abort_failed",
                object_key=object_key,
                upload_id=upload_id,
                error=str(e),
            )
            raise

    def generate_presigned_download_url(
        self, object_key: str, expires_in: int | None = None
    ) -> str:
        """Generate a short-lived presigned GET URL for downloading."""
        try:
            url = self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": object_key},
                ExpiresIn=expires_in or settings.download_url_expiry,
            )
            return url
        except ClientError as e:
            logger.error(
                "presigned_download_url_failed", object_key=object_key, error=str(e)
            )
            raise

    def delete_object(self, object_key: str) -> None:
        """Delete an object from R2."""
        try:
            self._client.delete_object(Bucket=self._bucket, Key=object_key)
            logger.info("object_deleted", object_key=object_key)
        except ClientError as e:
            logger.error("object_delete_failed", object_key=object_key, error=str(e))
            raise

    def head_object(self, object_key: str) -> dict | None:
        """Get object metadata. Returns None if object doesn't exist."""
        try:
            return self._client.head_object(Bucket=self._bucket, Key=object_key)
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return None
            raise


# Singleton
storage_service = R2StorageService()
