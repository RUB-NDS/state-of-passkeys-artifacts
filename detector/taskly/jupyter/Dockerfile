FROM jupyter/minimal-notebook:python-3.10

# set env
ENV debian_frontend=noninteractive

# set user
USER root

# install dependencies
RUN apt update
RUN apt upgrade -y
RUN apt install -y curl tar tmux

# install https://code.visualstudio.com/docs/remote/tunnels
RUN curl -Lk "https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64" --output /tmp/vscode_cli.tar.gz
RUN tar -xf /tmp/vscode_cli.tar.gz -C /usr/local/bin

# copy startup
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

# set entrypoint
ENTRYPOINT [ "/startup.sh" ]
