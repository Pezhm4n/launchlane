import os
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = False
ALLOWED_HOSTS = ["*"]
ROOT_URLCONF = "siteconfig.urls"
INSTALLED_APPS = []
MIDDLEWARE = []
DATABASES = {}
