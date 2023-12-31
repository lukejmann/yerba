import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import '~/patches';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
	<React.StrictMode>
		<Suspense>
			<App />
		</Suspense>
	</React.StrictMode>
);
