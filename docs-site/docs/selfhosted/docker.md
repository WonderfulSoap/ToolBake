---
sidebar_position: 2
---

# Use Docker

ToolBake also provides a Docker image for users to run with Docker.

> Note: Since ToolBake runs with UID 1000 in Docker, if you want to mount a data volume with the `-v` parameter, you need to ensure the volume permissions are set to 1000:1000, otherwise permission issues may occur.

```bash
mkdir ./data
chown 1000:1000 ./data
docker run -p 8080:8080 -v ./data:/app/data -d wondersoap/toolbake 
```

After successful execution, you can access ToolBake at `http://localhost:8080`.

## Environment Variables

All ToolBake configurations can be set through environment variables.

You can set environment variables in the Docker command using the `-e` parameter.

For example, the following set the database to mysql (default is sqlite):

```bash
docker run -p 8080:8080 \
  -v ./data:/app/data \
  -e DB_TYPE=mysql \
  -e MYSQL_HOST=mysql_host \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=xxx \
  -e MYSQL_PASS=xxx \
  -e MYSQL_DB=xxx \
  -d wondersoap/toolbake
```

For detailed environment variable information, please refer to the [configuration documentation](./configuration.md).

