import { Suspense } from 'react';
import { Outlet } from 'react-router';
import styled from 'styled-components/macro';

const ContentLayout = styled.div`
	display: flex;
	width: 100%;
	height: 100%;
`;

export const Component = () => {
	return (
		<ContentLayout>
			<Suspense>
				<Outlet />
			</Suspense>
			{/* <Preview /> */}
		</ContentLayout>
	);
};
