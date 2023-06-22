ARG DEBIAN_FRONTEND=noninteractive

# ENV DEBIAN_FRONTEND=noninteractive
# FROM python:3.10 as base
# ENV PYTHONUNBUFFERED=1
# ENV LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/usr/lib/x86_64-linux-gnu:/usr/local/nvidia/lib64:/usr/local/nvidia/bin
# RUN --mount=type=cache,target=/var/cache/apt set -eux; \
# 	apt-get update -qq; \
# 	apt-get install -qqy --no-install-recommends curl; \
# 	rm -rf /var/lib/apt/lists/*; \
# 	TINI_VERSION=v0.19.0; \
# 	TINI_ARCH="$(dpkg --print-architecture)"; \
# 	curl -sSL -o /sbin/tini "https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini-${TINI_ARCH}"; \
# 	chmod +x /sbin/tini
# ENTRYPOINT ["/sbin/tini", "--"]
# # COPY .cog/tmp/build3750710895/cog-0.0.1.dev-py3-none-any.whl /tmp/cog-0.0.1.dev-py3-none-any.whl
# RUN --mount=type=cache,target=/root/.cache/pip pip install /tmp/cog-0.0.1.dev-py3-none-any.whl
# RUN --mount=type=cache,target=/var/cache/apt apt-get update -qq && apt-get install -qqy libpng-dev libjpeg-dev && rm -rf /var/lib/apt/lists/*
# COPY .cog/tmp/build3750710895/requirements.txt /tmp/requirements.txt
# RUN --mount=type=cache,target=/root/.cache/pip pip install -r /tmp/requirements.txt
# WORKDIR /src
# EXPOSE 5000
# CMD ["python", "-m", "cog.server.http"]
# COPY . /src

#--

# FROM debian:bookworm as base

ARG DEBIAN_FRONTEND

ADD https://gist.githubusercontent.com/HeavenVolkoff/ff7b77b9087f956b8df944772e93c071/raw \
	/etc/apt/apt.conf.d/99docker-apt-config

RUN rm -f /etc/apt/apt.conf.d/docker-clean; \
	echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache

RUN --mount=type=cache,target=/var/cache/apt --mount=type=cache,target=/var/lib/apt \
	apt-get update && apt-get upgrade
#--

FROM base as build

ARG DEBIAN_FRONTEND

RUN --mount=type=cache,target=/var/cache/apt --mount=type=cache,target=/var/lib/apt \
	apt-get install build-essential git sudo unzip wget

RUN wget -qO- https://get.pnpm.io/install.sh | env SHELL=bash PNPM_HOME=/usr/share/pnpm sh -

ENV PNPM_HOME="/usr/share/pnpm" \
	PATH="/usr/share/pnpm:$PATH"

RUN pnpm env use --global latest

RUN wget -qO- https://sh.rustup.rs | sh -s -- -yq --profile minimal

ENV PATH="/root/.cargo/bin:$PATH"

WORKDIR /serve

COPY . .

WORKDIR /serve

RUN --mount=type=cache,target=/var/cache/apt --mount=type=cache,target=/var/lib/apt \
	sudo apt-get -y update && sudo apt-get -y install curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf openssl pkg-config clang

# build web app
RUN rm -rf node_modules
RUN pnpm install --frozen-lockfile
RUN pnpm app build

# RUN --mount=type=cache,target=/root/.cache/prisma/binaries/cli/ \
RUN	pnpm gen

# RUN cargo build --release -p server
RUN cargo build -p server

#--

FROM base

COPY --from=build /serve/target/debug/server /usr/bin/

EXPOSE 8080

VOLUME [ "/data" ]

ENTRYPOINT [ "server" ]

LABEL org.opencontainers.image.title="yerba server" \
	org.opencontainers.image.source="https://github.com/lukejmann/yerba"