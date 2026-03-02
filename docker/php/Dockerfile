FROM php:8.3-fpm-alpine

RUN apk add --no-cache \
    libzip-dev \
    zip \
    unzip \
    icu-dev \
    linux-headers \
    $PHPIZE_DEPS

RUN docker-php-ext-configure intl && \
    docker-php-ext-install pdo pdo_mysql mysqli zip intl opcache pcntl

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /var/www

COPY local.ini /usr/local/etc/php/conf.d/local.ini
