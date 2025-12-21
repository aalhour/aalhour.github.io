---
title: "A Queryable List for Python: Proof of Concept"
date: 2016-03-01
categories: [Programming]
tags: [Python, C#, LINQ, Functional Programming]
---

As a programmer who spent a long period of time developing software in C# and .NET, moving to the Python world was exciting, but at the same time it was not that easy. One of the challenges I had to face is to replace my dependance on the convenience of LINQ with other constructs that Python offers, such as the built-in methods `map`, `reduce` among others, as well as the cool built-in modules `functools` and `itertools`.

Some people might argue that LINQ is not the most efficient solution for querying collections, and it isn't. But on the other hand, it's definitely the most convenient and simplest one to write expressions in terms of queries or transformations on a data collection.

Here is a quick example that shows the differences in expressing the same query or expression in LINQ and Python using declarative-functional notation. We want to take 100 numbers, filter the odd ones out, map them to new numbers incremented by 1 and then reduce them by addition.

Here's the C# code snippet:

```csharp
// Declare list
List<Int32> numbers = new List<Int32>();

// Fill in the list
for (Int32 i=0; i < 100; ++i) {
  numbers.Add(i);
}

// Filter the odd numbers out, and then increment the rest by 1
numbers = numbers.Where (n => n % 2 == 0).Select (n => n + 1).ToList<Int32>();

// Reduce collection by addition
Int32 result = numbers.Sum ();

System.Console.WriteLine(result);
```

And here's the Python version:

```python
from operator import add
from functools import reduce

# Declare collection
numbers = list(range(0,100))

# Filter the odd numbers out and then increment remaining by 1
numbers = map(lambda n: n + 1, filter(lambda n: n % 2 != 0, numbers))

# Reduce collection by addition
result = reduce(add, numbers, 0)

# Print result
print(result)
```

The biggest difference that one can notice is that C#’s LINQ functions work by chaining where as Python’s methods work by composition. I think this is an obvious challenge in terms of readability and writing complex expressions, at least in my own opinion.

There are, however, really nice functional and declarative programming features in Python, in addition to 3rd party tooling support from the community, but the gap for a LINQ in Python cannot be filled with tooling, only a language-integrated query DSL inside Python itself as a host language can fill that gap and adhere to the batteries-included philosophy.

To cut to the chase, I miss LINQ a lot and I've attempted, more playfully than not, to recreate some of its extensions to Python's lists. Please do note, that this is not a polished production-ready library or what not, this is just a tinkering attempt to introduce an immutable collection on top of Lists in Python that can be queried. A proof of concept, more or less.

The full source code is hosted on the GitHub Gist: [https://gist.github.com/aalhour/f80b874add5c34f7c8b7](https://gist.github.com/aalhour/f80b874add5c34f7c8b7).

Here is how one might use this `QueryableList`:

```python
from operator import add
from queryable_list import QueryableList

# Boolean Predicates
multiples_of_2 = lambda x: x % 2 == 0

# Transformations
divide_by_10 = lambda x: float(x / 10.0)

# Raw data
numbers = list(range(-10000, 10000))

# A QueryableList collection that contains duplicate data
collection = QueryableList(numbers + numbers + numbers)

###
# BEGIN

# Query the collection in a declarative notation
query = collection.distinct()
                  .map(divide_by_10)
                  .filter(multiples_of_2)
                  .take_last(100)

# Reduce the queried items by addition
reduced_result = query.reduce(add)

# Print query data
print(reduced_result)
```

I hope you enjoyed this and noticed how much more beautiful and readable the QueryableList solution is than Python's methods composition pattern. If you have any comments, just shoot them below or head over to the **reddit discussion** linked below and join the others.

Until next time,

Cheers!

<hr />

**Discussion on Reddit:**&nbsp;[https://redd.it/489qgb](https://redd.it/489qgb).
