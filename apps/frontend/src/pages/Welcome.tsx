import {Link} from "react-router-dom";
export default function Welcome(){
    return(
        <div>
            <h1>Welcome to AI-mock</h1>
            <li><Link to="/auth">Get started</Link></li>
        </div>
    )

}