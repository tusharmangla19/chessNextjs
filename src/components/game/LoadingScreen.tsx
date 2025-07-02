import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface LoadingScreenProps {
    title: string;
}

export const LoadingScreen = ({ title }: LoadingScreenProps) => {
    return (
        <div className="h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <Card className="w-96">
                <CardHeader>
                    <CardTitle className="text-center">{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                </CardContent>
            </Card>
        </div>
    );
}; 