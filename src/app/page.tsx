import { ArrowRightIcon, BriefcaseIcon, FileTextIcon, MailIcon, MessagesSquareIcon, ShieldCheckIcon, WalletIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const OUTPUTS = [
  { icon: FileTextIcon, title: "CV ATS em PDF", text: "Seu currículo reescrito para a vaga, em coluna única e pronto para sistemas de triagem." },
  { icon: MailIcon, title: "E-mail para a empresa", text: "Mensagem curta e direta para mandar junto com o CV." },
  { icon: BriefcaseIcon, title: "Cover letter", text: "Carta em parágrafos, ligando suas experiências reais ao que a vaga pede." },
  { icon: MessagesSquareIcon, title: "Roteiro de entrevista", text: "Perguntas prováveis, respostas sugeridas e pontos de atenção." },
  { icon: WalletIcon, title: "Faixa salarial", text: "Estimativa com base em anúncios de vagas, sempre com a fonte." },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14">
      <section className="flex flex-col items-center gap-6 pt-6 text-center">
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs">Para vagas de TI, sem cadastro</span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Do currículo à candidatura completa em poucos minutos
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          Envie seu CV e a descrição da vaga. O MatchCV usa a IA que você escolher para gerar cinco materiais alinhados à
          vaga, sem inventar experiência e sem aquele jeito de texto de robô.
        </p>
        <Link href="/gerar" className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-base")}>
          Começar
          <ArrowRightIcon />
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OUTPUTS.map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="text-primary mb-2 size-5" />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-6 sm:flex-row sm:items-start">
        <ShieldCheckIcon className="text-primary size-6 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Sua chave não é salva</p>
          <p className="text-muted-foreground mt-1">
            Você usa sua própria API key (OpenAI, Anthropic, Gemini, Together ou OpenRouter). Ela fica só na memória da
            página, vai por HTTPS para a geração e é descartada em seguida. O currículo também não é armazenado.
          </p>
        </div>
      </section>
    </div>
  );
}
