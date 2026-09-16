FROM public.ecr.aws/lambda/python:3.11

# Static FFmpeg/ffprobe (zip Lambda has neither).
RUN microdnf install -y tar xz gzip \
  && curl -fsSL -o /tmp/ffmpeg.tar.xz \
    https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
  && mkdir -p /tmp/ffmpeg \
  && tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1 \
  && mv /tmp/ffmpeg/ffmpeg /tmp/ffmpeg/ffprobe /usr/local/bin/ \
  && chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe \
  && rm -rf /tmp/ffmpeg /tmp/ffmpeg.tar.xz \
  && microdnf clean all

ENV PATH="/usr/local/bin:${PATH}"

COPY handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
