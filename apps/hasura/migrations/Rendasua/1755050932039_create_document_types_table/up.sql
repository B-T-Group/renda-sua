-- Create document_types table
CREATE TABLE public.document_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert document types
INSERT INTO public.document_types (name, description) VALUES
    ('other', 'Other documents'),
    ('id_card', 'National ID Card'),
    ('passport', 'Passport'),
    ('company_registration', 'Company Registration Certificate'),
    ('bank_statements', 'Bank Statements'),
    ('proof_of_address', 'Proof of Address'),
    ('tax_clearance', 'Tax Clearance Certificate'),
    ('business_license', 'Business License'),
    ('insurance_certificate', 'Insurance Certificate'),
    ('vehicle_registration', 'Vehicle Registration'),
    ('driver_license', 'Driver License'),
    ('utility_bill', 'Utility Bill'),
    ('rental_agreement', 'Rental Agreement'),
    ('employment_letter', 'Employment Letter'),
    ('pay_slip', 'Pay Slip'),
    ('bank_reference', 'Bank Reference Letter'),
    ('trade_license', 'Trade License'),
    ('import_export_license', 'Import/Export License'),
    ('certificate_of_incorporation', 'Certificate of Incorporation'),
    ('memorandum_of_association', 'Memorandum of Association');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_types_updated_at
    BEFORE UPDATE ON public.document_types
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


