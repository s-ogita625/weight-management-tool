import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'プライバシーポリシー | 体重管理ツール' };

export default function PrivacyPage() {
  return (
    <article className="space-y-4 py-6 text-sm leading-relaxed text-slate-300">
      <h1 className="text-2xl font-black text-white">プライバシーポリシー</h1>
      <p>体重管理ツール（以下「本ツール」）は、個人の体重・食事・トレーニング管理を目的とした個人用アプリです。</p>
      <h2 className="pt-2 text-base font-bold text-white">取得する情報</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>ログイン用のメールアドレスとパスワード（パスワードはハッシュ化して保存）</li>
        <li>利用者が入力した体重・体脂肪率・体調・食事・水分・筋トレの記録</li>
        <li>
          Google Health API と連携した場合、Google Health に保存されている歩数・消費カロリー・距離・アクティブゾーン分・睡眠・運動の記録（読み取りのみ）
        </li>
      </ul>
      <h2 className="pt-2 text-base font-bold text-white">利用目的</h2>
      <p>取得した情報は、本ツール内での記録の表示・集計・分析とリマインド通知のためだけに使います。広告、第三者への販売・提供には使いません。</p>
      <h2 className="pt-2 text-base font-bold text-white">Google ユーザーデータの取り扱い</h2>
      <p>
        Google API から受け取った情報の使用と他のアプリへの転送は、
        <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        （Limited Use の要件を含む）に従います。アクセストークンは暗号化して保存し、連携解除時に Google 側の許可も取り消します。
      </p>
      <h2 className="pt-2 text-base font-bold text-white">保存と削除</h2>
      <p>データはクラウドデータベース（Neon）に保存されます。連携の解除は「メニュー → Fitbit 連携」から、データの削除は管理者への連絡でいつでも行えます。</p>
      <h2 className="pt-2 text-base font-bold text-white">お問い合わせ</h2>
      <p>ogitashiyu@gmail.com</p>
    </article>
  );
}
