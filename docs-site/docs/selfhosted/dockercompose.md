---
sidebar_position: 2
---

# Use Docker Compose

If you prefer to use Docker Compose, you can use the following configuration.

Of course, you also need to pay attention to the data volume permission issue:

```bash
mkdir ./data
chown 1000:1000 ./data
```

Then run with the following Docker Compose configuration:

```yaml
services:
  toolbake:
    image: wondersoap/toolbake
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    restart: on-failure
```

## Environment Variables

All ToolBake configurations can be set through environment variables

You can set environment variables in the Docker Compose configuration using the `environment` field.

For example, the following set the database to mysql(default is sqlite):

```yaml
services:
  toolbake:
    image: wondersoap/toolbake
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    environment:
      - DB_TYPE=mysql
      - MYSQL_HOST=mysql
      - MYSQL_PORT=3306
      - MYSQL_USER=xxx
      - MYSQL_PASS=xxx
      - MYSQL_DB=xxx
    restart: on-failure
  
  mysql:
    image: mysql:8.4
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=xxx
      - MYSQL_DATABASE=xxx
      - MYSQL_USER=xxx
      - MYSQL_PASSWORD=xxx
    volumes:
      - ./db-data:/var/lib/mysql
```

For detailed environment variable information, please refer to the [configuration documentation](./configuration.md).
