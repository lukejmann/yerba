import { QueryClient, QueryClientProvider, hydrate } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { YerbInterface, appRoutes } from './main';
import { RspcProvider } from './rspc';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: undefined
	}
});

const router = createBrowserRouter(appRoutes);

function App() {
	return (
		<div className="App">
			<RspcProvider queryClient={queryClient}>
				<QueryClientProvider client={queryClient}>
					<YerbInterface router={router} />
				</QueryClientProvider>
			</RspcProvider>
		</div>
	);
}

export default App;
