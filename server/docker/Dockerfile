ARG DEBIAN_FRONTEND=noninteractive


FROM python:3.10 as base
ENV PYTHONUNBUFFERED=1

RUN --mount=type=cache,target=/var/cache/apt set -eux; \
	apt-get update -qq; \
	apt-get install -qqy --no-install-recommends curl; \
	rm -rf /var/lib/apt/lists/*;

ARG DEBIAN_FRONTEND

ADD https://gist.githubusercontent.com/HeavenVolkoff/ff7b77b9087f956b8df944772e93c071/raw \
	/etc/apt/apt.conf.d/99docker-apt-config

RUN rm -f /etc/apt/apt.conf.d/docker-clean; \
	echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache

RUN --mount=type=cache,target=/var/cache/apt --mount=type=cache,target=/var/lib/apt \
	apt-get update && apt-get upgrade




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

RUN --mount=type=cache,target=/var/cache/apt --mount=type=cache,target=/var/lib/apt \
	sudo apt-get -y update && sudo apt-get -y install curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf openssl pkg-config clang

RUN rm -rf node_modules
RUN pnpm install --frozen-lockfile
RUN pnpm app build
RUN	pnpm gen
RUN cargo build -p server




FROM base as builder

ENV PIP_DEFAULT_TIMEOUT=100 \
	PIP_DISABLE_PIP_VERSION_CHECK=1 \
	PIP_NO_CACHE_DIR=1 \
	POETRY_VERSION=1.3.1

RUN pip install "poetry==1.5.1"

COPY server/python-server .

RUN poetry config virtualenvs.in-project true && \
	poetry install --only=main --no-root && \
	poetry build


FROM base

COPY --from=builder /.venv ./.venv
COPY --from=builder /dist /dist

COPY --from=build /serve/target/debug/server /usr/bin/
COPY --chmod=755 server/docker/entrypoint.sh /usr/bin/

EXPOSE 8080
EXPOSE 5001

RUN ./.venv/bin/pip install dist/*.whl


VOLUME [ "/data" ]

ENTRYPOINT [ "server" ]

LABEL org.opencontainers.image.title="yerba server" \
	org.opencontainers.image.source="https://github.com/lukejmann/yerba"