<?php
return ['name'=>'Invoice API','env'=>getenv('APP_ENV')?:'production','debug'=>false,'url'=>'http://localhost','timezone'=>'UTC','locale'=>'en','fallback_locale'=>'en','faker_locale'=>'en_US','key'=>getenv('APP_KEY')?:null,'cipher'=>'AES-256-CBC','providers'=>Illuminate\Support\ServiceProvider::defaultProviders()->toArray()];
