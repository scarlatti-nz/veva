import { useMsal } from "@azure/msal-react";
import { LogIn } from 'react-feather';
import { Button } from '../components/button/Button';
import './LoginPage.scss';

const LoginPage = () => {
    const { instance } = useMsal(); 

    const handleLogin = () => {
        instance.loginRedirect();
    }

    return (
        <div className="login-page" data-component="LoginPage">
            <div className="login-container">
                <h1>Welcome</h1>
                <p>Please log in to continue</p>
                <Button 
                    label="Login with Microsoft"
                    icon={LogIn}
                    iconPosition="end"
                    buttonStyle="action"
                    onClick={handleLogin}
                />
            </div>
        </div>
    )
}

export default LoginPage;