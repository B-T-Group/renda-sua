"""Setup configuration for rendasua-core-packages."""
from setuptools import setup, find_packages

setup(
    name="rendasua-core-packages",
    version="0.1.1",
    description="Core packages for Rendasua Lambda functions",
    long_description=open("README.md").read() if __import__("os").path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    packages=find_packages(where=".", exclude=["tests", "*.tests", "*.tests.*", "build", "dist", "*.egg-info"]),
    python_requires=">=3.9",
    install_requires=[
        "requests>=2.31.0",
        "sendgrid>=6.10.0",
        "pydantic>=2.0.0",
    ],
    extras_require={
        "dev": [
            "datamodel-code-generator>=0.25.0",
            "graphql-core>=3.2.0",
        ],
    },
    include_package_data=True,
    package_data={
        "*": ["*.py", "*.txt", "*.md"],
    },
    zip_safe=False,
)
