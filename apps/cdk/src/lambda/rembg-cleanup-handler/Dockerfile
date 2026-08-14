FROM public.ecr.aws/lambda/python:3.11

# Lambda filesystem is read-only except /tmp; numba/pymatting need a writable cache.
ENV NUMBA_CACHE_DIR=/tmp
ENV MPLCONFIGDIR=/tmp

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
# Prefer binary wheels (Lambda image has no compiler for source builds like numpy).
RUN pip install --upgrade pip \
  && pip install --no-cache-dir --only-binary=:all: -r requirements.txt

# Bake U2Net weights into the image (readable by the Lambda runtime user).
# Note: rembg 2.0.57 does not ship birefnet-* sessions; unknown names fall back to u2net.
ENV U2NET_HOME=/opt/models
RUN mkdir -p /opt/models \
  && python -c "from rembg import new_session; s=new_session('u2net'); assert type(s).__name__=='U2netSession', type(s)" \
  && chmod -R a+rX /opt/models \
  && ls -la /opt/models

COPY handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
