from mhart/alpine-node:8

RUN apk add --update \
    sqlite \
    && rm -rf /var/cache/apk/*

# Create app directory
RUN mkdir -p /wekan-gogs
WORKDIR /wekan-gogs

# Install app dependencies
COPY package.json .
RUN npm install

# Bundle app source
COPY . /wekan-gogs

EXPOSE 7654
CMD [ "npm", "start" ]
