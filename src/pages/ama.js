import Layout from "../components/Layout";
import { useState } from "react";
import Link from "next/link";
import notion, { databaseId } from "../notion";
import { post } from "../api";
import { parseISO, formatDistance } from "date-fns";
import { sync as markdown } from "../markdown";
import { Container, H1 } from "../components";

export default function AmaPage({ questions }) {
  const [body, setBody] = useState("");
  const [didSubmit, setDidSubmit] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();

    let result;
    try {
      result = await post("/api/ama/ask", { body });
    } catch (error) {}

    setBody("");
    setDidSubmit(true);

    return result;
  };

  return (
    <Layout active="ama" title="AMA">
      <Container>
        <header className="text-lg">
          <H1>Ask Me Anything</H1>
          <h2 className="text-gray-500">
            Anything goes! Questions will show up when I add an answer.
          </h2>
        </header>

        <div className="h-3 lg:h-8"></div>

        <form onSubmit={onSubmit} className="max-w-xl">
          <textarea
            rows={3}
            className="mb-2 input w-100"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="How do you even…"
          />

          {body !== "" && (
            <button
              type="submit"
              className="text-black bg-gradient-to-br from-gold-500 to-sunset-300 shadow-sm btn"
            >
              Ask question
            </button>
          )}
          {didSubmit && (
            <div className="p-3 text-gray-900 bg-gold-300">
              <p>
                Question received! Don't forget to check back later for an
                answer ✌
              </p>
            </div>
          )}
        </form>

        <div className="h-6 lg:h-8"></div>

        <div className="text-lg leading-relaxed nested-links max-w-prose">
          {questions.results.map((question) => (
            <div key={question.id}>
              <Question question={question} />
              <div className="mb-8 lg:mb-12" />
            </div>
          ))}
        </div>
      </Container>
    </Layout>
  );
}

export const getStaticProps = async () => {
  const questions = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "published",
      checkbox: { equals: true },
    },
    sorts: [
      {
        property: "answeredAt",
        direction: "descending",
      },
      {
        property: "updatedAt",
        direction: "descending",
      },
    ],
  });

  return {
    props: { questions },
    revalidate: 10, // secs
  };
};

const Question = ({ question }) => {
  const [upvotes, setUpvotes] = useState(question.properties.upvotes.number);
  const hash = `question-${question.id}`;
  const date =
    question.properties.answeredAt.date.start ||
    question.properties.updatedAt.last_edited_time;

  return (
    <>
      <dt className="mb-2">
        <a className="font-bold" href={`#${hash}`} name={hash}>
          Q: {question.properties.question.title[0].plain_text}
        </a>
      </dt>
      <dd className="prose-lg">
        <Answer block={question.properties.answer} />

        <p className="mt-2 text-gray-500">
          <button
            className={`relative px-1 py-0 -ml-1 btn ${
              upvotes > 0 && "text-red-500"
            }`}
            onClick={() => {
              setUpvotes(upvotes + 1);
              upvote(question.id).then(setUpvotes);
            }}
          >
            &hearts;{upvotes}
          </button>
          &nbsp;&middot;&nbsp; {formatDistance(parseISO(date), new Date())} ago
        </p>
      </dd>
    </>
  );
};

const Answer = ({ block }) => {
  switch (block.type) {
    case "rich_text":
      return <RichText block={block} />;
    default:
      return <div />;
  }
};

const RichText = ({ block }) => {
  return (
    <div>
      {block.rich_text.map((token, i) => {
        let text = token.plain_text;
        if (text.match(/\n\n/))
          text = (
            <span
              dangerouslySetInnerHTML={{
                __html: text.replace("\n\n", "<br><br>"),
              }}
            />
          );
        if (token.href) text = <a href={token.href}>{text}</a>;
        if (token.annotations.bold) text = <strong>{text}</strong>;
        if (token.annotations.italic) text = <em>{text}</em>;
        if (token.annotations.strikethrough) text = <del>{text}</del>;
        if (token.annotations.underline) text = <u>{text}</u>;
        return <span key={i}>{text}</span>;
      })}
    </div>
  );
};

const upvote = async (id) => {
  let result;

  try {
    result = await post("/api/ama/upvote", { id });
  } catch (err) {
    console.error(err);
  }

  return (result && result.upvotes) || "err";
};
