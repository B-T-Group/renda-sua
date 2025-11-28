FROM public.ecr.aws/lambda/python:3.11

# Copy requirements
COPY requests-layer/requirements.txt .

# Install dependencies
RUN pip install -r requirements.txt -t python/lib/python3.11/site-packages/

# Create the layer zip
RUN zip -r requests-layer.zip python/

CMD ["/bin/bash"]
