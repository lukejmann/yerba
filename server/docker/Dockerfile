ARG DEBIAN_FRONTEND=noninteractive

#--

FROM debian:bookworm as base

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

RUN --mount=type=cache,target=/root/.cache/prisma/binaries/cli/ \
	pnpm gen

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