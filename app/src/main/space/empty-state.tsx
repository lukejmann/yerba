import styled from 'styled-components/macro';

const NoSpaceSelectedWrapper = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
`;

export const NoSpaceSelected = () => {
	return <NoSpaceSelectedWrapper>No space selected</NoSpaceSelectedWrapper>;
};
