use std::{env, net::SocketAddr};

use axum::{
    extract::{DefaultBodyLimit, Multipart},
    handler::Handler,
    routing::{get, post},
};
use server::{custom_uri::create_custom_uri_endpoint, get_spaces_dir, Node};
use tower_http::cors::CorsLayer;
use tracing::{debug, info};

mod utils;

static APP_DIR: include_dir::Dir<'static> =
    include_dir::include_dir!("$CARGO_MANIFEST_DIR/../app/dist");

#[tokio::main]
async fn main() {
    let spaces_dir = get_spaces_dir().await;

    let port = env::var("PORT")
        .map(|port| port.parse::<u16>().unwrap_or(8080))
        .unwrap_or(8080);

    let _ = Node::init_logger(spaces_dir.clone());

    let (node, router) = match Node::new(spaces_dir).await {
        Ok(d) => d,
        Err(e) => {
            panic!("{}", e.to_string())
        }
    };
    let signal = utils::axum_shutdown_signal(node.clone());

    let app = axum::Router::new()
        .route(
            "/",
            get(|| async move {
                use axum::{
                    body::{self, Full},
                    response::Response,
                };
                use http::{header, HeaderValue, StatusCode};

                debug!("serving index.html");

                match APP_DIR.get_file("index.html") {
                    Some(file) => Response::builder()
                        .status(StatusCode::OK)
                        .header(
                            header::CONTENT_TYPE,
                            HeaderValue::from_str("text/html").unwrap(),
                        )
                        .body(body::boxed(Full::from(file.contents())))
                        .unwrap(),
                    None => Response::builder()
                        .status(StatusCode::NOT_FOUND)
                        .body(body::boxed(axum::body::Empty::new()))
                        .unwrap(),
                }
            }),
        )
        .route(
            "/*id",
            get(
                |axum::extract::Path(path): axum::extract::Path<String>| async move {
                    use axum::{
                        body::{self, Empty, Full},
                        response::Response,
                    };
                    use http::{header, HeaderValue, StatusCode};

                    let path = path.trim_start_matches('/');
                    match APP_DIR.get_file(path) {
                        Some(file) => Response::builder()
                            .status(StatusCode::OK)
                            .header(
                                header::CONTENT_TYPE,
                                HeaderValue::from_str(
                                    mime_guess::from_path(path).first_or_text_plain().as_ref(),
                                )
                                .unwrap(),
                            )
                            .body(body::boxed(Full::from(file.contents())))
                            .unwrap(),
                        None => match APP_DIR.get_file("index.html") {
                            Some(file) => Response::builder()
                                .status(StatusCode::OK)
                                .header(
                                    header::CONTENT_TYPE,
                                    HeaderValue::from_str("text/html").unwrap(),
                                )
                                .body(body::boxed(Full::from(file.contents())))
                                .unwrap(),
                            None => Response::builder()
                                .status(StatusCode::NOT_FOUND)
                                .body(body::boxed(Empty::new()))
                                .unwrap(),
                        },
                    }
                },
            ),
        )
        .route("/upload", {
            let node = node.clone();
            post(|mut files: Multipart| async move {
                info!("uploading file – in MultiPart callback");
                let field = files.next_field().await.unwrap().unwrap();
                let name = field.name().unwrap().to_string();
                let datajwt = field.bytes().await.unwrap();
                if name != "jwt" {
                    return "jwt not found";
                }

                let field = files.next_field().await.unwrap().unwrap();
                let name = field.name().unwrap().to_string();
                let dataspace_uuid = field.bytes().await.unwrap();
                if name != "space_uuid" {
                    return "space_uuid not found";
                }

                let jwt = String::from_utf8(datajwt.to_vec()).unwrap();
                let space_uuid = String::from_utf8(dataspace_uuid.to_vec()).unwrap();

                while let Some(field) = files.next_field().await.unwrap_or(None) {
                    let name = field.name().unwrap().to_string();
                    let data = field.bytes().await.unwrap();
                    let path = String::from_utf8(data.to_vec()).unwrap();
                    if name != "path" {
                        return "file not found";
                    }

                    let field = files.next_field().await.unwrap().unwrap();
                    let name = field.name().unwrap().to_string();
                    let _filename = field.file_name().unwrap().to_string();
                    let data = field.bytes().await.unwrap();

                    if name != "file" {
                        return "file not found";
                    }

                    let res = node
                        .handle_file_upload(
                            jwt.clone(),
                            space_uuid.clone(),
                            // upload_uuid,
                            path,
                            &data,
                        )
                        .await;

                    if let Err(_e) = res {
                        return "Error uploading file";
                    }
                }
                return "done";
            })
        })
        .nest("/yerb", create_custom_uri_endpoint(node.clone()).axum())
        .nest("/rspc", router.endpoint(move || node.clone()).axum())
        .layer(CorsLayer::very_permissive())
        .layer(DefaultBodyLimit::max(usize::MAX));

    let addr = "[::]:8080".parse::<SocketAddr>().unwrap();
    info!("Listening on http://localhost:{}", port);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .with_graceful_shutdown(signal)
        .await
        .expect("Error with HTTP server!");
}
