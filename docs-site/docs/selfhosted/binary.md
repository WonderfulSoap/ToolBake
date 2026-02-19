---
sidebar_position: 1
---

# Execute the Binary

Thanks to the characteristics of Golang, self-hosting ToolBake is extremely simple.

You just need to download the binary and run it directly — that's all it takes to self-host. No runtime environment configuration, no complex setup required.

Visit the [Release page](https://github.com/WonderfulSoap/ToolBake/releases), download the corresponding ToolBake version, then:

Here's an example of downloading the Linux x64 version:

```bash
chmod +x toolbake-linux-amd64-v0.1.0
./toolbake-linux-amd64-v0.1.0
```

All done. After successful execution, you can access ToolBake at `http://localhost:8080`.

## Environment Variables

All ToolBake configurations can be set through environment variables

You can use the `export ENV_NAME=VALUE` format to set the corresponding environment variables.

For example, the following resets the ToolBake binding address to `localhost:8080` (the default is `0.0.0.0:8080`):

```bash
export HOST=localhost:8080
./toolbake-linux-amd64-v0.1.0
```

For detailed environment variable information, please refer to the [configuration documentation](./configuration.md).


