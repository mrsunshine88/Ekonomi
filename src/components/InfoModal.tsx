import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

import { createPortal } from 'react-dom';

interface InfoModalProps {
  type: 'tos' | 'privacy' | 'contact';
  onClose: () => void;
}

export default function InfoModal({ type, onClose }: InfoModalProps) {
  const [contactInfo, setContactInfo] = useState<{
    company: string;
    email: string;
    address: string;
    phone: string;
  }>({
    company: '',
    email: '',
    address: '',
    phone: ''
  });
  const [visibility, setVisibility] = useState({
    company: true,
    email: true,
    address: true,
    phone: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (type === 'contact') {
      const fetchContactInfo = async () => {
        setLoading(true);
        const { data } = await supabase.from('global_settings').select('key, value');
        if (data) {
          const info = {
            company: data.find(d => d.key === 'contact_company')?.value || 'SmartEkonomi AB',
            email: data.find(d => d.key === 'contact_email')?.value || 'info@exempel.se',
            address: data.find(d => d.key === 'contact_address')?.value || '-',
            phone: data.find(d => d.key === 'contact_phone')?.value || '-'
          };
          setContactInfo(info);
          setVisibility({
            company: data.find(d => d.key === 'show_contact_company')?.value !== 'false',
            email: data.find(d => d.key === 'show_contact_email')?.value !== 'false',
            address: data.find(d => d.key === 'show_contact_address')?.value !== 'false',
            phone: data.find(d => d.key === 'show_contact_phone')?.value !== 'false'
          });
        }
        setLoading(false);
      };
      fetchContactInfo();
    }
  }, [type]);

  const titles = {
    tos: 'Användarvillkor (Terms of Service)',
    privacy: 'Integritetspolicy (GDPR)',
    contact: 'Kontakt'
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '2rem'
    }}>
      <div style={{ 
        background: 'rgba(30, 41, 59, 0.95)', 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        borderRadius: '16px', 
        padding: '2rem', 
        maxWidth: '600px', 
        width: '100%', 
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '1.5rem', right: '1.5rem',
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
            width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
          }}
        >
          ✕
        </button>

        <h2 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '1.5rem' }}>
          {titles[type]}
        </h2>

        <div style={{ color: '#ccc', fontSize: '0.95rem', lineHeight: '1.6' }}>
          {type === 'tos' && (
            <>
              <p style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#fff' }}>Ansvarsfriskrivning:</strong> Appen är ett beräkningsverktyg. Vi ansvarar inte för eventuella matematiska fel, buggar eller ekonomiska beslut som fattas baserat på appens data.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Betalning:</strong> Tjänsten kostar 59 kr/månad per hushåll. Nya prenumeranter får alltid 14 dagars gratis provperiod innan den första debiteringen sker via Stripe. Prenumerationen dras löpande tills man avslutar.
              </p>
            </>
          )}

          {type === 'privacy' && (
            <>
              <p style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#fff' }}>Vilken data du sparar:</strong> Vi sparar din e-postadress (för inloggning) samt de ekonomiska siffror du själv matar in i appen.
              </p>
              <p style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#fff' }}>Tredjepart:</strong> Betalningsdata hanteras säkert av Stripe. Vi ser eller sparar aldrig dina kortuppgifter på våra servrar.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Rätten att bli glömd:</strong> Du kan när som helst radera ditt konto, vilket källkodsmässigt rensar all din data helt från databasen via vår SQL Cascade-logik.
              </p>
            </>
          )}

          {type === 'contact' && (
            <>
              {loading ? (
                <p>Laddar kontaktuppgifter...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {visibility.company && (
                    <div>
                      <strong style={{ color: '#fff', display: 'block', marginBottom: '0.2rem' }}>Företag / Namn:</strong>
                      {contactInfo.company}
                    </div>
                  )}
                  {visibility.email && (
                    <div>
                      <strong style={{ color: '#fff', display: 'block', marginBottom: '0.2rem' }}>E-postadress:</strong>
                      <a href={`mailto:${contactInfo.email}`} style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
                        {contactInfo.email}
                      </a>
                    </div>
                  )}
                  {visibility.phone && (
                    <div>
                      <strong style={{ color: '#fff', display: 'block', marginBottom: '0.2rem' }}>Telefonnummer:</strong>
                      {contactInfo.phone}
                    </div>
                  )}
                  {visibility.address && (
                    <div>
                      <strong style={{ color: '#fff', display: 'block', marginBottom: '0.2rem' }}>Adress:</strong>
                      {contactInfo.address}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
