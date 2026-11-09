import type { Metadata } from 'next';

export const metadata: Metadata = { title: '利用規約 | 体重管理ツール' };

export default function TermsPage() {
  return (
    <article className="space-y-4 py-6 text-sm leading-relaxed text-slate-300">
      <h1 className="text-2xl font-black text-white">利用規約</h1>
      <p>体重管理ツール（以下「本ツール」）は、個人の健康管理を補助するための個人用アプリです。</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>本ツールが表示する数値・提案は参考情報であり、医療行為や医師・管理栄養士の指導に代わるものではありません。</li>
        <li>基礎疾患のある方、妊娠中の方、未成年の方は、医師などの専門家に相談のうえ利用してください。</li>
        <li>本ツールの利用により生じた損害について、開発者は責任を負いません。</li>
        <li>本ツールは予告なく内容の変更・提供の停止を行うことがあります。</li>
        <li>Google Health との連携はいつでも解除できます。</li>
      </ul>
      <p>お問い合わせ: ogitashiyu@gmail.com</p>
    </article>
  );
}
