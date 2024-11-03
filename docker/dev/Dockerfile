# Downgrade NodeJS 21 as a workaround for the ExperimentalWarning
# Upgrade it when there is a fix version deployed
FROM node:21

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY ./paper-node-configuration /usr/src/app/paper-node-configuration
COPY ./paper-text-writer/. /usr/src/app/paper-text-writer

WORKDIR /usr/src/app/paper-text-writer

RUN npm install

ARG ENVIRONMENT_NAME

ENV ENVIRONMENT=$ENVIRONMENT_NAME

CMD npm run start-${ENVIRONMENT}
