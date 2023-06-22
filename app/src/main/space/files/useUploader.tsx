import { useCallback } from 'react';
import { useEffect, useState } from 'react';
import { currentSpaceCache } from '~/main/user/SpacesProvider';
import { authStore, useSpaceMutation } from '~/rspc';

export const useUploader = () => {
	const [items, setItems] = useState<DataTransferItemList | null>(null);
	const [rootDirs, setRootDirs] = useState<string[] | null>(null);
	const [rootFiles, setRootFiles] = useState<{ name: string; extension: string }[] | null>(null);
	const [files, setFiles] = useState<{ name: string; file: any }[]>([]);

	const [uploading, setUploading] = useState(false);

	const [doneProcessing, setDoneProcessing] = useState(false);
	const [doneUploading, setDoneUploading] = useState(false);
	const [rootPath, setRootPath] = useState<string>('/');

	const [batchUUID, setBatchUUID] = useState<string | null>(null);

	const [pathToUploadUUID, setPathToUploadUUID] = useState<string[][] | null>(null);

	const reset = useCallback(() => {
		setItems(null);
		setRootDirs(null);
		setRootFiles(null);
		setFiles([]);
		setUploading(false);

		setDoneProcessing(false);

		setRootPath('/');
	}, []);

	const uploadFile = useSpaceMutation('tasks.uploadFile');

	const beginUpload = useCallback(async () => {
		const jwt = authStore.jwt;

		if (!jwt) {
			console.error('Attempted to do space operation with no user set!');
			return;
		}

		const spaceId = currentSpaceCache.id;
		if (spaceId === null) throw new Error('Attempted to do space operation with no space set!');

		const uploadURL = `${http}://${serverOrigin}/upload`;

		const formData = new FormData();

		let i = 0;

		formData.append('jwt_token', jwt);
		formData.append('space_uuid', spaceId);

		console.log('space_uuid', spaceId);
		console.log('jwt_token', jwt);

		for (let n = 0; n < files.length; n++) {
			console.log('files[n].name', files[n]);
			if (!files[n]?.name) continue;
			const res = await uploadFile.mutateAsync(
				{
					// @ts-ignore
					path: files[n].name
				},
				{
					onError: (err) => {
						console.log('err', err);
					}
				}
			);
			console.log('res', res);
		}

		for (const file of files) {
			formData.append('path', file.name);
			formData.append('file', file.file, file.name);

			i++;
		}

		const res = await fetch(uploadURL, {
			method: 'POST',
			body: formData,
			headers: {
				jwt_token: jwt,
				space_uuid: spaceId
			}
		});
		console.log('res', res);

		setDoneUploading(true);
		reset();
	}, [files, rootPath]);

	const processPaths = useCallback(async () => {
		if (!items) {
			return;
		}

		const traverseUpload = async (item: any, path?: string) => {
			path = path || '';
			const files: { name: string; file: any }[] = [];
			let done = false;

			if (item.isFile) {
				const fileRes0 = await item.file(function (file: any) {
					console.log('file', file);
					files.push({ name: path + file.name, file });
					done = true;
				});
			} else if (item.isDirectory) {
				var dirReader = item.createReader();

				const readRes = await dirReader.readEntries(async function (entries: any) {
					for (var i = 0; i < entries.length; i++) {
						const newFiles = await traverseUpload(entries[i], path + item.name + '/');
						files.push(...(newFiles as { name: string; file: any }[]));
					}
					done = true;
				});
			}
			const returnWhenDone = new Promise((resolve) => {
				const interval = setInterval(() => {
					if (done) {
						clearInterval(interval);
						resolve(files);
					}
				}, 10);
			});
			return returnWhenDone;
		};

		const scanPromises = [];
		for (let n = 0; n < items.length; n++) {
			const scanPromise = async () => {
				const item = (items[n] as DataTransferItem).webkitGetAsEntry();
				if (item) {
					const filesNew = await traverseUpload(item);
					return filesNew;
				}
			};
			scanPromises.push(scanPromise());
		}
		const filesNew = await Promise.all(scanPromises);
		const filesAll: { name: string; file: any }[] = [];
		filesNew.forEach((files) => {
			filesAll.push(...(files as { name: string; file: any }[]));
		});

		if (filesAll.length === 0) {
			return;
		}

		console.log('filesAll', filesAll);

		const rootDirsTemp: string[] = [];
		const rootFilesTemp: { name: string; extension: string }[] = [];

		filesAll.forEach((file) => {
			const split = file.name.split('/');
			// @ts-ignore
			if (split.length > 1 && !rootDirsTemp.includes(split[0])) {
				// @ts-ignore
				rootDirsTemp.push(split[0]);
			} else if (
				split.length === 1 &&
				!rootFilesTemp.find((rootFile) => rootFile.name === split[0])
			) {
				// @ts-ignore
				const split2 = split[0].split('.');
				// @ts-ignore
				rootFilesTemp.push({ name: split2[0], extension: split2[1] });
			}
		});
		console.log('rootDirsTemp', rootDirsTemp);
		console.log('rootFilesTemp', rootFilesTemp);

		setRootDirs(rootDirsTemp);
		setRootFiles(rootFiles);
		setFiles(filesAll);
		console.log('set files to', files);
		setDoneProcessing(true);

		return filesAll.length;
	}, [items]);

	useEffect(() => {
		reset();
		if (items) processPaths();
	}, [items]);

	useEffect(() => {
		if (doneProcessing) {
			setUploading(true);
			beginUpload();
		}
	}, [beginUpload, doneProcessing]);

	return {
		setItems,
		setRootPath,
		uploading,
		doneUploading,
		doneProcessing,
		rootDirs,
		rootFiles
	};
};
