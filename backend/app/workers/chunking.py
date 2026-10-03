import asyncio
import tempfile
import os
import httpx
import static_ffmpeg
static_ffmpeg.add_paths() # Ensures ffmpeg/ffprobe binaries are dynamically available
import ffmpeg
from app.core.config import settings
from app.core.supabase import supabase_client
from app.core.logging import get_logger

logger = get_logger(__name__)

async def get_audio_chunks(presigned_url: str, storage_path_base: str) -> list[dict]:
    """
    Downloads the audio, checks duration, and chunks if > 4 hours.
    Returns a list of dicts: {"url": str, "offset_ms": int}
    """
    import pathlib
    ext = pathlib.Path(storage_path_base).suffix or ".mp3"
    # 1. Stream download to temp file
    fd, tmp_path = tempfile.mkstemp(suffix=ext)
    os.close(fd)
    
    logger.info("Downloading audio for chunking check", url=presigned_url[:50])
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream("GET", presigned_url) as resp:
                resp.raise_for_status()
                with open(tmp_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=8192):
                        f.write(chunk)
                        
        # 2. Probe duration
        def probe_file():
            return ffmpeg.probe(tmp_path)
            
        probe = await asyncio.to_thread(probe_file)
        duration_s = float(probe['format']['duration'])
        
        if duration_s <= 14400: # 4 hours
            logger.info("Audio duration <= 4 hours. No chunking needed.", duration_s=duration_s)
            return [{"url": presigned_url, "offset_ms": 0}]
            
        # 3. Chunking needed
        chunk_duration = 12600 # 3.5 hours
        num_chunks = int(duration_s // chunk_duration) + (1 if duration_s % chunk_duration > 0 else 0)
        logger.info("Audio duration > 4 hours. Chunking required.", duration_s=duration_s, num_chunks=num_chunks)
        
        chunks = []
        for i in range(num_chunks):
            out_path = tmp_path.replace(ext, f"_part{i}{ext}")
            start_time = i * chunk_duration
            
            def split_file(in_f, out_f, st, t):
                ffmpeg.input(in_f, ss=st, t=t).output(out_f, c="copy").run(overwrite_output=True, quiet=True)
                
            await asyncio.to_thread(split_file, tmp_path, out_path, start_time, chunk_duration)
            
            # Upload chunk to Supabase
            chunk_storage_path = f"{storage_path_base}_part{i}{ext}"
            
            def upload_chunk(cp, path):
                with open(cp, "rb") as f:
                    supabase_client.storage.from_(settings.supabase_bucket_name).upload(path, f.read())
                    
            await asyncio.to_thread(upload_chunk, out_path, chunk_storage_path)
            
            def get_chunk_url():
                return supabase_client.storage.from_(settings.supabase_bucket_name).create_signed_url(
                    chunk_storage_path,
                    expires_in=settings.gnani_url_expiry,
                )
            response = await asyncio.to_thread(get_chunk_url)
            chunk_url = response.get("signedURL") or response.get("signedUrl")
            chunks.append({"url": chunk_url, "offset_ms": start_time * 1000})
            
            os.unlink(out_path)
            
        return chunks
        
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
