declare namespace JSX {
    interface IntrinsicElements {
        'elevenlabs-convai': import('react').DetailedHTMLProps<
            import('react').HTMLAttributes<HTMLElement> & { 'agent-id'?: string },
            HTMLElement
        >;
    }
}
