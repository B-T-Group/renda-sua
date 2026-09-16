FROM public.ecr.aws/lambda/python:3.11

# Static binaries from Docker Hub (johnvansickle.com is often blocked in CI).
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM public.ecr.aws/lambda/python:3.11
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
ENV PATH="/usr/local/bin:${PATH}"

COPY handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
