import { loginBrands, type LoginBrand } from '../lib/loginBranding'

export function LoginArtwork({ brand }: { brand: LoginBrand }) {
  const config = loginBrands[brand]
  return <section className="login-artwork" aria-label={`${config.name} workspace introduction`}>
    <div className="login-mosaic" aria-hidden="true">
      <span className="mosaic-shape mosaic-leaf-tall" /><span className="mosaic-shape mosaic-circle-top" />
      <span className="mosaic-shape mosaic-leaf-wide" /><span className="mosaic-shape mosaic-leaf-small" />
      <span className="mosaic-shape mosaic-quarter-light" /><span className="mosaic-shape mosaic-leaf-light" />
      <span className="mosaic-shape mosaic-quarter-dark" /><span className="mosaic-shape mosaic-orb" />
      <span className="mosaic-shape mosaic-bottom-square" /><span className="mosaic-shape mosaic-bottom-curve" />
      <span className="mosaic-shape mosaic-pearl" /><span className="mosaic-orbit"><i /></span>
      {config.photos.map((photo, i) => <span key={photo} className={`login-photo-motion mosaic-placement-${i + 1} photo-float-${i + 1}`}><span className={`mosaic-photo mosaic-photo-${i + 1}`}><img data-photo={photo} src={`/login/${photo}.jpg`} alt="" decoding="async" onError={e => { e.currentTarget.style.opacity = '0' }} /></span></span>)}
    </div>
    <div className="login-platform-brands" aria-label="Qalo and eNL CRM"><img src={loginBrands.qalo.logo} alt="Qalo Ya Afrika" /><img src={loginBrands.enl.logo} alt="eNL Mutual Bank" /></div>
    <div className="login-glass-story"><h2>{config.heading}</h2><p>{config.description}</p><span className="login-story-accent"><i />{config.feature}</span></div>
  </section>
}
