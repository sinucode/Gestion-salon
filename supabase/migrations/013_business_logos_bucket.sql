-- ============================================
-- Migration 013: Business Logos Storage Bucket
-- ============================================

-- Create the storage bucket for business logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('business_logos', 'business_logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public reading
CREATE POLICY "Logos are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'business_logos' );

-- Policies for authenticated users (we'll keep it simple for now, allowing authenticated users to upload)
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'business_logos' );

CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'business_logos' );

CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'business_logos' );
