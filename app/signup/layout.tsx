export default function SignupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
            {children}
        </div>
    );
}
