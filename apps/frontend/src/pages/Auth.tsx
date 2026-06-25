import {SignIn} from "@clerk/clerk-react";

export default function Auth(){
  return(
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>

      <SignIn routing="path" path="/auth" />
    </div>
  );
}