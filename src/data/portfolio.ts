export type PortfolioLink = {
  label: string
  href: string
}

export type PortfolioEntry = {
  id: string
  title: string
  summary: string
  tags: string[]
  links: PortfolioLink[]
  /**
   * World center of the 1×1×1 exhibit. Use integer x and z (grid cells).
   * Floor tier: y = 0.5; stack more blocks at the same x,z with y = 1.5, 2.5, …
   */
  position: [number, number, number]
  color: string
}

export const portfolioEntries: PortfolioEntry[] = [
  {
    id: 'about',
    title: 'About this space',
    summary:
      'This hub is a playful way to browse work: each block is a project or story. Replace the copy and links below with your own.',
    tags: ['Three.js', 'React', 'R3F'],
    links: [{ label: 'React Three Fiber docs', href: 'https://docs.pmnd.rs/react-three-fiber/' }],
    position: [0, 0.5, 0],
    color: '#6b8cff',
  },
  {
    id: 'project-one',
    title: 'Project Alpha',
    summary:
      'Placeholder project — describe the problem, your role, and the outcome in a few sentences.',
    tags: ['TypeScript', 'UI'],
    links: [
      { label: 'Live demo', href: 'https://example.com' },
      { label: 'Source', href: 'https://github.com' },
    ],
    position: [-3, 0.5, 3],
    color: '#4ecdc4',
  },
  {
    id: 'project-two',
    title: 'Project Beta',
    summary:
      'Another sample exhibit. Use integer x/z so blocks sit on the same 1×1 grid as the player.',
    tags: ['WebGL', 'Design'],
    links: [{ label: 'Case study', href: 'https://example.com' }],
    position: [4, 0.5, 2],
    color: '#ff8c69',
  },
  {
    id: 'project-three',
    title: 'Project Gamma',
    summary:
      'Use tags for skills and stacks; use links for demos, repos, or articles.',
    tags: ['API', 'Performance'],
    links: [{ label: 'Article', href: 'https://example.com' }],
    position: [0, 0.5, -5],
    color: '#c084fc',
  },
  {
    id: 'project-four',
    title: 'Project Delta',
    summary:
      'When you are ready, trade these boxes for glTF models via useGLTF while keeping the same ids and data file.',
    tags: ['3D', 'Blender'],
    links: [{ label: 'Sketchfab', href: 'https://sketchfab.com' }],
    position: [-4, 0.5, -3],
    color: '#fbbf24',
  },
  // Three-block climb test wall (stand on e.g. cell x=6, z=0, walk +X into x=7)
  {
    id: 'climb-test-wall-bottom',
    title: 'Climb test — wall (bottom)',
    summary:
      'Stacked with mid/top to form a 3-high wall. Remove these entries when you no longer need the test.',
    tags: ['Dev'],
    links: [],
    position: [7, 0.5, 0],
    color: '#78716c',
  },
  {
    id: 'climb-test-wall-mid',
    title: 'Climb test — wall (mid)',
    summary: 'Middle voxel of the 3-high test wall.',
    tags: ['Dev'],
    links: [],
    position: [7, 1.5, 0],
    color: '#78716c',
  },
  {
    id: 'climb-test-wall-top',
    title: 'Climb test — wall (top)',
    summary: 'Top voxel of the 3-high test wall.',
    tags: ['Dev'],
    links: [],
    position: [7, 2.5, 0],
    color: '#6b6560',
  },
]
