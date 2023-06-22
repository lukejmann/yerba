import styled from 'styled-components/macro';

export const TextBase = styled.div`
	font-size: 11px;
	letter-spacing: -0.01em;
	font-weight: 550;
`;

export const SubtextBase = styled.div`
	font-size: 11px;
	letter-spacing: -0.005em;
	font-weight: 450;
`;

export const SpaceTitle = styled(TextBase)`
	font-size: 18.3586px;
	color: ${({ theme }) => theme.text1};
`;

export const SpaceSubtitle = styled(SubtextBase)`
	font-size: 14.2269px;
	color: ${({ theme }) => theme.text2};
`;

export const SectionHeader = styled(TextBase)`
	color: ${({ theme }) => theme.text1};
`;

export const ItemTitle = styled(TextBase)`
	color: ${({ theme }) => theme.text1};
`;

export const ItemSubtitle = styled(SubtextBase)`
	color: ${({ theme }) => theme.text2};
`;

export const ItemStatus = styled(SubtextBase)`
	font-style: normal;
	font-weight: 700;
	font-size: 9.82263px;

	letter-spacing: -0.005em;

	color: ${({ theme }) => theme.text2};
`;

export const FormText = styled(TextBase)`
	color: ${({ theme }) => theme.text1};
`;
