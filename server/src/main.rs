use std::{env, net::SocketAddr};

use anyhow::Error;
use axum::{
    extract::{DefaultBodyLimit, Multipart},
    handler::Handler,
    routing::{get, post},
};
use server::{custom_uri::create_custom_uri_endpoint, get_spaces_dir, Node};
use tower_http::cors::CorsLayer;
use tracing::info;

mod utils;

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
        .route("/upload", {
            let node = node.clone();
            post(|mut files: Multipart| async move {
                info!("uploading file – in MultiPart callback");
                let field = files.next_field().await.unwrap().unwrap();
                let name = field.name().unwrap().to_string();
                let datajwt_token = field.bytes().await.unwrap();
                if name != "jwt_token" {
                    return "jwt_token not found";
                }

                let field = files.next_field().await.unwrap().unwrap();
                let name = field.name().unwrap().to_string();
                let dataspace_uuid = field.bytes().await.unwrap();
                if name != "space_uuid" {
                    return "space_uuid not found";
                }

                let jwt_token = String::from_utf8(datajwt_token.to_vec()).unwrap();
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
                            jwt_token.clone(),
                            space_uuid.clone(),
                            // upload_uuid,
                            path,
                            &data,
                        )
                        .await;

                    if let Err(e) = res {
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
