FROM public.ecr.aws/lambda/python:3.11

# Fetch static ffmpeg/ffprobe in a builder that has a package manager.
FROM debian:bookworm-slim AS ffmpeg
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
  && curl -fsSL -o /tmp/ffmpeg.tar.xz \
    https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
  && mkdir -p /tmp/ffmpeg \
  && tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1 \
  && install -m 0755 /tmp/ffmpeg/ffmpeg /tmp/ffmpeg/ffprobe /usr/local/bin/ \
  && rm -rf /tmp/ffmpeg /tmp/ffmpeg.tar.xz /var/lib/apt/lists/*

FROM public.ecr.aws/lambda/python:3.11
COPY --from=ffmpeg /usr/local/bin/ffmpeg /usr/local/bin/ffprobe /usr/local/bin/
ENV PATH="/usr/local/bin:${PATH}"

COPY handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
