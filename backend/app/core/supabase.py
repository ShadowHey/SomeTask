"""Supabase client initialization."""

from supabase import Client, create_client

from app.core.config import settings


def get_supabase_client() -> Client:
    """Get an authenticated Supabase client using the Service Role Key."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# Singleton instance
supabase_client = get_supabase_client()
