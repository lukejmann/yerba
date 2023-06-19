use crate::{get_spaces_dir, utils::u2b, Node};

use custom_prisma::prisma::file;
use http_range::HttpRange;
use std::{io, mem::take, path::PathBuf, sync::Arc};

#[cfg(windows)]
use std::cmp::min;

use httpz::{
    http::{response::Builder, Method, Response, StatusCode},
    Endpoint, GenericEndpoint, HttpEndpoint, Request,
};
use mini_moka::sync::Cache;
use once_cell::sync::Lazy;
use prisma_client_rust::QueryError;
use std::path::Path;
use thiserror::Error;
use tokio::{
    fs::File,
    io::{AsyncReadExt, AsyncSeekExt, SeekFrom},
};
use tracing::{error, info};
use uuid::Uuid;

#[derive(Debug, Error)]
#[error("error accessing path: '{}'", .path.display())]
pub struct FileIOError {
    path: Box<Path>,
    #[source]
    source: io::Error,
}

impl<P: AsRef<Path>> From<(P, io::Error)> for FileIOError {
    fn from((path, source): (P, io::Error)) -> Self {
        Self {
            path: path.as_ref().into(),
            source,
        }
    }
}

#[derive(Debug, Error)]
#[error("received a non UTF-8 path: <lossy_path='{}'>", .0.to_string_lossy())]
pub struct NonUtf8PathError(pub Box<Path>);

type MetadataCacheKey = (Uuid, Uuid);
type NameAndExtension = (PathBuf, String);
static FILE_METADATA_CACHE: Lazy<Cache<MetadataCacheKey, NameAndExtension>> =
    Lazy::new(|| Cache::new(100));

async fn handler(node: Arc<Node>, req: Request) -> Result<Response<Vec<u8>>, HandleCustomUriError> {
    let path = req
        .uri()
        .path()
        .strip_prefix('/')
        .unwrap_or_else(|| req.uri().path())
        .split('/')
        .collect::<Vec<_>>();

    println!("path: {:?}", path);

    match path.first() {
        Some(&"file") => handle_file(&node, &path, &req).await,
        _ => Err(HandleCustomUriError::BadRequest("Invalid operation!")),
    }
}

async fn read_file(mut file: File, length: u64, start: Option<u64>) -> io::Result<Vec<u8>> {
    let mut buf = Vec::with_capacity(length as usize);
    if let Some(start) = start {
        file.seek(SeekFrom::Start(start)).await?;
        file.take(length).read_to_end(&mut buf).await?;
    } else {
        file.read_to_end(&mut buf).await?;
    }

    Ok(buf)
}

fn cors(
    method: &Method,
    builder: &mut Builder,
) -> Option<Result<Response<Vec<u8>>, httpz::http::Error>> {
    *builder = take(builder).header("Access-Control-Allow-Origin", "*");
    if method == Method::OPTIONS {
        Some(
            take(builder)
                .header("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")
                .header("Access-Control-Allow-Headers", "*")
                .header("Access-Control-Max-Age", "86400")
                .status(StatusCode::OK)
                .body(vec![]),
        )
    } else {
        None
    }
}

async fn handle_file(
    node: &Node,
    path: &[&str],
    req: &Request,
) -> Result<Response<Vec<u8>>, HandleCustomUriError> {
    let method = req.method();
    let mut builder = Response::builder();
    if let Some(response) = cors(method, &mut builder) {
        return Ok(response?);
    }

    let space_id = path
        .get(1)
        .and_then(|id| id.parse::<Uuid>().ok())
        .ok_or_else(|| {
            HandleCustomUriError::BadRequest("Invalid number of parameters. Missing space_id!")
        })?;

    let file_id = path
        .get(2)
        .and_then(|id| id.parse::<Uuid>().ok())
        .ok_or_else(|| {
            HandleCustomUriError::BadRequest("Invalid number of parameters. Missing file_id!")
        })?;

    let lru_cache_key = (space_id, file_id);

    let (file_path_full_path, extension) =
        if let Some(entry) = FILE_METADATA_CACHE.get(&lru_cache_key) {
            entry
        } else {
            let space = node
                .space_manager
                .get_space(space_id)
                .await
                .ok_or_else(|| HandleCustomUriError::NotFound("space"))?;

            let file = space
                .db
                .file()
                .find_unique(file::id::equals(u2b(file_id)))
                .exec()
                .await?
                .ok_or_else(|| HandleCustomUriError::NotFound("object"))?;

            let space_base_path = get_spaces_dir().await;
            let space_path = space_base_path.join(space_id.to_string());
            let file_path = space_path.join(file.path.clone());
            info!("fetch file file_path: {:?}", file_path);

            let lru_entry = (file_path, file.extension);
            FILE_METADATA_CACHE.insert(lru_cache_key, lru_entry.clone());

            lru_entry
        };

    let file = File::open(&file_path_full_path).await.map_err(|err| {
        if err.kind() == io::ErrorKind::NotFound {
            HandleCustomUriError::NotFound("file")
        } else {
            FileIOError::from((&file_path_full_path, err)).into()
        }
    })?;

    let mime_type = match extension.as_str().to_lowercase().as_str() {
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "gif" => "image/gif",
        "jpeg" | "jpg" => "image/jpeg",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "tif" | "tiff" => "image/tiff",
        "webp" => "image/webp",
        "pdf" => "application/pdf",
        "heif" | "heifs" => "image/heif,image/heif-sequence",
        "heic" | "heics" => "image/heic,image/heic-sequence",

        "avif" | "avci" | "avcs" => "image/avif",
        _ => {
            println!("extension: {}", extension);
            return Err(HandleCustomUriError::BadRequest(
                "TODO: This filetype is not supported because of the missing mime type!",
            ));
        }
    };

    let mut content_lenght = file
        .metadata()
        .await
        .map_err(|e| FileIOError::from((&file_path_full_path, e)))?
        .len();

    let range = if method == Method::GET {
        if let Some(range) = req.headers().get("range") {
            range
                .to_str()
                .ok()
                .and_then(|range| HttpRange::parse(range, content_lenght).ok())
                .ok_or_else(|| {
                    HandleCustomUriError::RangeNotSatisfiable("Error decoding range header!")
                })
                .and_then(|range| {
                    if range.len() > 1 {
                        Err(HandleCustomUriError::RangeNotSatisfiable(
                            "Multiple ranges are not supported!",
                        ))
                    } else {
                        Ok(range.first().cloned())
                    }
                })?
        } else {
            None
        }
    } else {
        None
    };

    let mut status_code = 200;
    let buf = match range {
        Some(range) => {
            let file_size = content_lenght;
            content_lenght = range.length;

            let last_byte = range.start + content_lenght - 1;

            status_code = 206;

            builder = builder
                .header("Connection", "Keep-Alive")
                .header("Accept-Ranges", "bytes")
                .header(
                    "Content-Range",
                    format!("bytes {}-{}/{}", range.start, last_byte, file_size),
                );

            read_file(file, content_lenght, Some(range.start))
                .await
                .map_err(|e| FileIOError::from((&file_path_full_path, e)))?
        }
        _ if method == Method::HEAD => {
            builder = builder.header("Accept-Ranges", "bytes");
            vec![]
        }
        _ => read_file(file, content_lenght, None)
            .await
            .map_err(|e| FileIOError::from((&file_path_full_path, e)))?,
    };

    Ok(builder
        .header("Content-type", mime_type)
        .header("Content-Length", content_lenght)
        .status(status_code)
        .body(buf)?)
}

pub fn create_custom_uri_endpoint(node: Arc<Node>) -> Endpoint<impl HttpEndpoint> {
    GenericEndpoint::new(
        "/*any",
        [Method::HEAD, Method::OPTIONS, Method::GET, Method::POST],
        move |req: Request| {
            let node = node.clone();
            async move { handler(node, req).await.unwrap_or_else(Into::into) }
        },
    )
}

#[derive(Error, Debug)]
pub enum HandleCustomUriError {
    #[error("error creating http request/response: {0}")]
    Http(#[from] httpz::http::Error),
    #[error("io error: {0}")]
    FileIO(#[from] FileIOError),
    #[error("query error: {0}")]
    QueryError(#[from] QueryError),
    #[error("{0}")]
    BadRequest(&'static str),
    #[error("Range is not valid: {0}")]
    RangeNotSatisfiable(&'static str),
    #[error("resource '{0}' not found")]
    NotFound(&'static str),
}

impl From<HandleCustomUriError> for Response<Vec<u8>> {
    fn from(value: HandleCustomUriError) -> Self {
        let builder = Response::builder().header("Content-Type", "text/plain");

        (match value {
            HandleCustomUriError::Http(err) => {
                error!("Error creating http request/response: {:#?}", err);
                builder
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(b"Internal Server Error".to_vec())
            }
            HandleCustomUriError::FileIO(err) => {
                error!("IO error: {:#?}", err);
                builder
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(b"Internal Server Error".to_vec())
            }
            HandleCustomUriError::QueryError(err) => {
                error!("Query error: {:#?}", err);
                builder
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(b"Internal Server Error".to_vec())
            }
            HandleCustomUriError::BadRequest(msg) => {
                error!("Bad request: {}", msg);
                builder
                    .status(StatusCode::BAD_REQUEST)
                    .body(msg.as_bytes().to_vec())
            }
            HandleCustomUriError::RangeNotSatisfiable(msg) => {
                error!("Invalid Range header in request: {}", msg);
                builder
                    .status(StatusCode::RANGE_NOT_SATISFIABLE)
                    .body(msg.as_bytes().to_vec())
            }
            HandleCustomUriError::NotFound(resource) => builder.status(StatusCode::NOT_FOUND).body(
                format!("Resource '{resource}' not found")
                    .as_bytes()
                    .to_vec(),
            ),
        })
        .expect("internal error building hardcoded HTTP error response")
    }
}
