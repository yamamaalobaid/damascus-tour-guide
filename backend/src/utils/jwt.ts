import jwt, { SignOptions } from 'jsonwebtoken';

export const generateToken = (id: number): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  // استخدم String() constructor لتلبية نوع StringValue
  const expiresIn = process.env.JWT_EXPIRE ? new String(process.env.JWT_EXPIRE) : '7d';
  
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn']
  };
  
  return jwt.sign({ id }, secret, options);
};

export const verifyToken = (token: string): any => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};