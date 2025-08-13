-- Create user_uploads table
CREATE TABLE public.user_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    document_type_id INTEGER NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
    note TEXT,
    content_type VARCHAR(255) NOT NULL,
    key VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_user_uploads_user_id ON public.user_uploads(user_id);
CREATE INDEX idx_user_uploads_document_type_id ON public.user_uploads(document_type_id);
CREATE INDEX idx_user_uploads_created_at ON public.user_uploads(created_at);

-- Create updated_at trigger
CREATE TRIGGER user_uploads_updated_at
    BEFORE UPDATE ON public.user_uploads
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

