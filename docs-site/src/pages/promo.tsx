import React from 'react';
import Layout from '@theme/Layout';
import styles from './promo.module.css';

const shots = [
  { src: '/sc/image3.png', alt: '界面截图 1', className: styles.cardA },
  { src: '/sc/image2.png', alt: '界面截图 2', className: styles.cardB },
  { src: '/sc/image1.png', alt: '界面截图 3', className: styles.cardC },
  { src: '/sc/image6.png', alt: '界面截图 4', className: styles.cardD },
  { src: '/sc/image5.png', alt: '界面截图 5', className: styles.cardE },
  { src: '/sc/image4.png', alt: '界面截图 6', className: styles.cardF },
];

export default function PromoPage() {
  return (
    <Layout title="Promo" description="Layered showcase poster">
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.bgGlow} />
          <div className={styles.bgGrid} />

          <div className={styles.stage}>
            {shots.map((item) => (
              <figure key={item.src} className={`${styles.card} ${item.className}`}>
                <img src={item.src} alt={item.alt} loading="lazy" />
              </figure>
            ))}

            <div className={styles.header}>
              <a
                className={styles.demoLink}
                href="https://toolbake.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Demo Site
              </a>
              <h1 className={styles.brandTitle}>ToolBake</h1>
              <p className={styles.subhead}>A Platform for Customizable Tools</p>
              <div className={styles.pills}>
                <span>Run your tools in browser</span>
                <span>Generate tools with AI</span>
              </div>
            </div>
            <div className={styles.ring} />
            <div className={styles.ringSecondary} />
          </div>
        </section>
      </main>
    </Layout>
  );
}
