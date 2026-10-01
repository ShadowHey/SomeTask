"""initial

Revision ID: 0001
Revises: 
Create Date: 2026-10-01 08:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create extension for fuzzy search
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    
    # Create tables
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    op.create_table(
        'audio_files',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('original_filename', sa.String(length=500), nullable=False),
        sa.Column('display_name', sa.String(length=500), nullable=False),
        sa.Column('object_key', sa.String(length=1000), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('language_code', sa.String(length=50), nullable=True),
        sa.Column('upload_id', sa.String(length=500), nullable=True),
        sa.Column('failure_stage', sa.String(length=50), nullable=True),
        sa.Column('failure_code', sa.String(length=100), nullable=True),
        sa.Column('failure_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('object_key')
    )
    op.create_index(op.f('ix_audio_files_status'), 'audio_files', ['status'], unique=False)
    op.create_index(op.f('ix_audio_files_user_id'), 'audio_files', ['user_id'], unique=False)
    op.create_index('ix_audio_files_user_created', 'audio_files', ['user_id', 'created_at'], unique=False)
    
    op.create_table(
        'processing_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('audio_file_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_type', sa.String(length=30), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('attempt_count', sa.Integer(), nullable=False),
        sa.Column('max_attempts', sa.Integer(), nullable=False),
        sa.Column('provider_job_id', sa.String(length=500), nullable=True),
        sa.Column('raw_provider_response', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('chunk_index', sa.Integer(), nullable=True),
        sa.Column('chunk_offset_ms', sa.Integer(), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('error_code', sa.String(length=100), nullable=True),
        sa.Column('retryable', sa.Boolean(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_retry_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['audio_file_id'], ['audio_files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_processing_jobs_audio_file_id'), 'processing_jobs', ['audio_file_id'], unique=False)
    
    op.create_table(
        'raw_transcripts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('audio_file_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('raw_response', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['audio_file_id'], ['audio_files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_raw_transcripts_audio_file_id'), 'raw_transcripts', ['audio_file_id'], unique=False)
    
    op.create_table(
        'summaries',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('audio_file_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('attempt_count', sa.Integer(), nullable=False),
        sa.Column('raw_response', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['audio_file_id'], ['audio_files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('audio_file_id')
    )
    
    op.create_table(
        'transcript_segments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('audio_file_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('start_ms', sa.Integer(), nullable=True),
        sa.Column('end_ms', sa.Integer(), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['audio_file_id'], ['audio_files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transcript_segments_audio_file_id'), 'transcript_segments', ['audio_file_id'], unique=False)
    op.create_index('ix_transcript_segments_audio_seq', 'transcript_segments', ['audio_file_id', 'sequence'], unique=False)
    
    # Create GIN index for fuzzy search on transcript_segments.text
    op.execute('CREATE INDEX transcript_segments_text_trgm_idx ON transcript_segments USING gin (text gin_trgm_ops)')


def downgrade() -> None:
    op.execute('DROP INDEX transcript_segments_text_trgm_idx')
    op.drop_index('ix_transcript_segments_audio_seq', table_name='transcript_segments')
    op.drop_index(op.f('ix_transcript_segments_audio_file_id'), table_name='transcript_segments')
    op.drop_table('transcript_segments')
    op.drop_table('summaries')
    op.drop_index(op.f('ix_raw_transcripts_audio_file_id'), table_name='raw_transcripts')
    op.drop_table('raw_transcripts')
    op.drop_index(op.f('ix_processing_jobs_audio_file_id'), table_name='processing_jobs')
    op.drop_table('processing_jobs')
    op.drop_index('ix_audio_files_user_created', table_name='audio_files')
    op.drop_index(op.f('ix_audio_files_user_id'), table_name='audio_files')
    op.drop_index(op.f('ix_audio_files_status'), table_name='audio_files')
    op.drop_table('audio_files')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.execute('DROP EXTENSION IF EXISTS pg_trgm')
