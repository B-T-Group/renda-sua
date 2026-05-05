# AWS (Frontend)

## What AWS is

AWS (Amazon Web Services) is the cloud platform used for infrastructure and some storage-related features.

## How it’s used by the frontend

The frontend does not call AWS services directly. For example, when uploading a file, the frontend typically:

- asks the backend for a **pre-signed upload URL**, then
- uploads directly to the storage URL it receives.

## Configuration required (Frontend)

None specific to AWS.

