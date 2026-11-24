import { Link } from 'react-router-dom';
import { Empty } from '../components/ui';
export default function NotFound() {
  return <div className="container-x pt-10"><Empty icon="🍕" title="Sahifa topilmadi (404)" text="Bu sahifa mavjud emas yoki o'chirilgan." action={<Link to="/" className="btn-primary">Bosh sahifa</Link>} /></div>;
}
