# Environment Configuration Setup

This document explains how to set up environment-specific configuration for the Rendasua backend application.

## Environment Files

The application uses three environment-specific configuration files:

### 1. `.env.production` - Production Environment

- Contains production-specific values for MyPVit, AWS, Hasura, etc.
- **MyPVit Production Values:**
  - `MYPVIT_CALLBACK_URL_CODE=8UH73`
  - `MYPVIT_SECRET_REFRESH_URL_CODE=BQ1TV`
  - `MYPVIT_MERCHANT_OPERATION_ACCOUNT_CODE=ACC_001122334455`
  - `MYPVIT_SECRET_KEY=CJF0DPOVZU87UUK8`
  - `NODE_ENV=production`

### 2. `.env.development` - Development Environment

- Contains development-specific values
- **MyPVit Development Values:**
  - `MYPVIT_CALLBACK_URL_CODE=FJXSU`
  - `MYPVIT_SECRET_REFRESH_URL_CODE=TRUVU`
  - `MYPVIT_MERCHANT_OPERATION_ACCOUNT_CODE=ACC_68A722C33473B`
  - `MYPVIT_SECRET_KEY=CTCNJRBWZIDALEGT`
  - `NODE_ENV=development`

### 3. `.env` - Local Environment

- Contains local development values
- **MyPVit Local Values:**
  - `MYPVIT_CALLBACK_URL_CODE=FJXSU`
  - `MYPVIT_SECRET_REFRESH_URL_CODE=TRUVU`
  - `MYPVIT_MERCHANT_OPERATION_ACCOUNT_CODE=ACC_68A722C33473B`
  - `MYPVIT_SECRET_KEY=CTCNJRBWZIDALEGT`
  - `NODE_ENV=development`

## Setup Instructions

1. **Environment files are already configured** with the correct MyPVit values
2. **Update other values** as needed:

   - Replace placeholder values with actual credentials
   - Update API keys, database URLs, and other sensitive information
   - Keep the MyPVit endpoint codes as specified above

3. **Environment Selection:**
   - The application will automatically use the appropriate environment file based on `NODE_ENV`
   - Set `NODE_ENV=production` for production
   - Set `NODE_ENV=development` for development
   - Set `NODE_ENV=local` for local development

## MyPVit Configuration

### Endpoints by Environment

| Environment     | Payment            | KYC                | Balance            | Secret Renewal     |
| --------------- | ------------------ | ------------------ | ------------------ | ------------------ |
| **Production**  | `OLHRVTQPJBQEIHRT` | `LRMFT2YW3YCCHKEH` | `NQUPMQFT35COWOWW` | `XI1OVAQBUCK8WEJC` |
| **Development** | `X5T3RIBYQUDFBZSH` | `W2OZPE4QDSWH3Z5R` | `LIRYOTW7QL3DCDPJ` | `RYXA6SLFNRBFFQJX` |
| **Local**       | `X5T3RIBYQUDFBZSH` | `W2OZPE4QDSWH3Z5R` | `LIRYOTW7QL3DCDPJ` | `RYXA6SLFNRBFFQJX` |

### Account Codes by Environment

| Environment     | Account Code        |
| --------------- | ------------------- |
| **Production**  | `ACC_001122334455`  |
| **Development** | `ACC_68A722C33473B` |
| **Local**       | `ACC_68A722C33473B` |

## Important Notes

- **Never commit actual `.env` files** to version control
- **MyPVit endpoint codes are environment-specific** and should not be changed
- **Secret keys are managed via AWS Secrets Manager** in production
- **Environment files are already configured** with the correct MyPVit values

## Troubleshooting

If you encounter configuration errors:

1. Check that the appropriate `.env` file exists
2. Verify all required environment variables are set
3. Ensure `NODE_ENV` is set correctly
4. Check that MyPVit endpoint codes match your environment
