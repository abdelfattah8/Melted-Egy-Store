import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInstagram, faFacebook, faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { faEnvelope } from '@fortawesome/free-solid-svg-icons'
import logoPink from '../assets/brand/melted-logo-pink.png'

export default function Footer() {
  return ( 
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <img src={logoPink} alt="Melted" style={{ height: 56, width: 'auto', maxWidth: '100%', display: 'block', marginBottom: 12 }} />
          <p>Made to melt hearts 🍫<br />Handcrafted desserts made fresh with premium ingredients and rich flavors</p>
          {/* <div className="footer-social">
            <a href="https://www.instagram.com/melted.egypt" target="_blank" rel="noreferrer" title="Instagram" aria-label="Instagram">
              <FontAwesomeIcon icon={faInstagram} style={{ fontSize: 20 }} />
            </a>
            <a href="https://www.facebook.com/share/18h3nLtYf9/" target="_blank" rel="noreferrer" title="Facebook" aria-label="Facebook">
              <FontAwesomeIcon icon={faFacebook} style={{ fontSize: 20 }} />
            </a>
            <a href="https://wa.me/201104064435" target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp">
              <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: 20 }} />
            </a>
          </div> */}
        </div>

        <div className="footer-col">
          <h4>Quick Links</h4>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/shop">Shop</Link></li>
            <li><Link to="/checkout">Cart</Link></li>
            <li><Link to="/my-orders">My Orders</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Delivery Areas</h4>
          <ul>
            <li><span style={{ fontSize: 14, opacity: 0.65 }}>Cairo</span></li>
            <li><span style={{ fontSize: 14, opacity: 0.65 }}>Giza</span></li>
            <li><span style={{ fontSize: 14, opacity: 0.65 }}>Orders by arrangement</span></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Follow Us</h4>
          {/* <ul>
            <li><a href="https://www.instagram.com/melted.egypt" target="_blank" rel="noreferrer">Instagram</a></li>
            <li><a href="https://www.facebook.com/share/18h3nLtYf9/" target="_blank" rel="noreferrer">Facebook</a></li>
            <li><a href="https://wa.me/201104064435" target="_blank" rel="noreferrer">WhatsApp</a></li>
          </ul> */}
          <div className="footer-social">
            <ul style={{ display: 'flex', gap: 16, padding: 0, marginLeft: -10, listStyle: 'none' }}>
              <li>
                <a href="https://www.instagram.com/melted.egypt" target="_blank" rel="noreferrer" title="Instagram" aria-label="Instagram">
                  <FontAwesomeIcon icon={faInstagram} style={{ fontSize: 20 }} />
                </a>
              </li>
              <li>
                <a href="https://www.facebook.com/share/18h3nLtYf9/" target="_blank" rel="noreferrer" title="Facebook" aria-label="Facebook">
                  <FontAwesomeIcon icon={faFacebook} style={{ fontSize: 20 }} />
                </a>
              </li>
              <li>
                <a href="https://wa.me/201104064435" target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp">
                  <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: 20 }} />
                </a>
              </li>
              <li>
                <a href="mailto:meltedegypt0@gmail.com" title="Email" aria-label="Email us">
                  <FontAwesomeIcon icon={faEnvelope} style={{ fontSize: 20 }} />
                </a>
              </li>
            </ul>
            
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Melted Egypt — Made with 🍫</p>
      </div>
    </footer>
  )
}
